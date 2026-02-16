import json
import logging
import re

from agents.tools.registry import TOOL_MAP, get_tools_for_prompt
from utils.llm_client import chat_completion_with_history

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 5

REACT_SYSTEM_TEMPLATE = """You are AtlasIQ, a knowledgeable travel expert AI with access to real country data tools.

You use a Reason-then-Act approach:
1. THINK about what information you need
2. Optionally call a tool to get real data
3. Use the data to give an accurate, grounded answer

{tools}

## How to respond

For EVERY response, use one of these two formats:

### Format A — When you need data from a tool:
THOUGHT: [your reasoning about what information you need]
ACTION: tool_name({{"param": "value"}})

### Format B — When you have enough information to answer:
THOUGHT: [your reasoning]
ANSWER: [your final response to the user]

IMPORTANT RULES:
- Always start with THOUGHT:
- Use ACTION: to call exactly ONE tool per step
- After receiving OBSERVATION (tool result), continue with another THOUGHT
- When ready, use ANSWER: to give your final response
- The ANSWER should be conversational and helpful, not raw JSON
- Keep answers concise (3-5 sentences) unless the user asks for detail
- Do not use markdown formatting in ANSWER
- Reference real data from tools when available

{rag_context}"""


class ReActAgent:
    def __init__(self):
        self.tools = TOOL_MAP

    async def run(
        self,
        messages: list[dict],
        country_code: str = "",
        rag_context: str = "",
    ) -> dict:
        """Execute ReAct loop. Returns dict with reply, thoughts, iterations."""
        tools_text = get_tools_for_prompt()
        system_prompt = REACT_SYSTEM_TEMPLATE.format(
            tools=tools_text,
            rag_context=rag_context,
        )

        # Build working message list
        working_messages = [{"role": "system", "content": system_prompt}]
        # Add conversation history (skip any system messages from input)
        for m in messages:
            if m["role"] != "system":
                working_messages.append(m)

        thoughts = []
        iterations = 0

        for i in range(MAX_ITERATIONS):
            iterations = i + 1

            response = await chat_completion_with_history(
                messages=working_messages,
                temperature=0.3,
                max_tokens=1024,
            )

            # Parse the response
            thought, action, answer = self._parse_response(response)

            if thought:
                thoughts.append(thought)

            # If we got a final answer, return it
            if answer is not None:
                return {
                    "reply": answer,
                    "thoughts": thoughts,
                    "iterations": iterations,
                }

            # If we got an action, execute the tool
            if action:
                tool_name, tool_params = action
                observation = await self._execute_tool(tool_name, tool_params)

                # Append the assistant's response and the observation
                working_messages.append({"role": "assistant", "content": response})
                working_messages.append({
                    "role": "user",
                    "content": f"OBSERVATION: {observation}",
                })
                continue

            # If response didn't follow format, treat as direct answer
            return {
                "reply": response.strip(),
                "thoughts": thoughts,
                "iterations": iterations,
            }

        # Max iterations reached — force a final answer
        working_messages.append({
            "role": "user",
            "content": "You have reached the maximum number of steps. Please provide your final ANSWER now based on what you know.",
        })
        response = await chat_completion_with_history(
            messages=working_messages,
            temperature=0.3,
            max_tokens=1024,
        )
        _, _, answer = self._parse_response(response)
        return {
            "reply": answer or response.strip(),
            "thoughts": thoughts,
            "iterations": iterations,
        }

    def _parse_response(self, response: str) -> tuple:
        """Parse THOUGHT/ACTION/ANSWER from response.

        Returns (thought, action, answer) where:
        - thought: str or None
        - action: (tool_name, params_dict) or None
        - answer: str or None
        """
        thought = None
        action = None
        answer = None

        # Extract THOUGHT
        thought_match = re.search(r"THOUGHT:\s*(.+?)(?=\nACTION:|\nANSWER:|\Z)", response, re.DOTALL)
        if thought_match:
            thought = thought_match.group(1).strip()

        # Extract ANSWER
        answer_match = re.search(r"ANSWER:\s*(.+)", response, re.DOTALL)
        if answer_match:
            answer = answer_match.group(1).strip()
            return thought, None, answer

        # Extract ACTION
        action_match = re.search(r"ACTION:\s*(\w+)\((.+?)\)\s*$", response, re.DOTALL | re.MULTILINE)
        if action_match:
            tool_name = action_match.group(1)
            params_raw = action_match.group(2).strip()
            try:
                params = json.loads(params_raw)
            except json.JSONDecodeError:
                params = {}
            action = (tool_name, params)

        return thought, action, answer

    async def _execute_tool(self, tool_name: str, params: dict) -> str:
        """Execute a tool and return the result string."""
        if tool_name not in self.tools:
            valid = ", ".join(self.tools.keys())
            return json.dumps({"error": f"Unknown tool: {tool_name}. Valid tools: {valid}"})
        try:
            result = await self.tools[tool_name](params)
            return result
        except Exception as e:
            logger.exception("Tool execution failed: %s", tool_name)
            return json.dumps({"error": f"Tool {tool_name} failed: {str(e)}"})
