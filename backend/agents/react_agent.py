import json
import logging
import re

from agents.tools.registry import TOOL_MAP, get_tools_for_prompt
from services.places_service import search_nearby_places
from utils.llm_client import chat_completion_with_history

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 5

REACT_SYSTEM_TEMPLATE = """You are AtlasIQ, a smart AI assistant specializing in travel and world knowledge, with access to real-time data tools.

You MUST use a Reason-then-Act approach:
1. THINK about what information you need
2. Call a tool if needed to get real, up-to-date data
3. Use the data to give an accurate, grounded answer

{tools}

## How to respond

For EVERY response, use one of these formats:

### Format A — Call a tool (when you need real-time or factual data):
THOUGHT: [your reasoning about what information you need]
ACTION: tool_name({{"param": "value"}})

### Format B — Give a direct answer (when you have enough info from tools or your own knowledge):
THOUGHT: [your reasoning]
ANSWER: [your final response to the user]

## WHEN TO USE TOOLS:

- **Places / restaurants / food / attractions / hotels / cafes / things to do / sightseeing / nightlife / shopping**: You MUST call `search_nearby_places` BEFORE answering. NEVER answer these from your own knowledge. Include the city/location in the query parameter (e.g. "biryani restaurants in Hyderabad"). The tool returns real ratings, reviews, and addresses.
- **Country scores / safety / budget / travel tips**: Use `get_country_details` or `get_travel_tips` first.
- **Comparisons**: Use `compare_countries` first.
- **Rankings**: Use `rank_by_preference` first.
- **Weather / temperature / climate now**: Use `get_weather` first. It gives real-time temperature, humidity, wind, and conditions.
- **Current events / advisories / news**: Use `web_search` or `news_search` first.
- **General knowledge (who is X, what is Y, history, science, people, etc.)**: Use `web_search` to find accurate info. This is important — do NOT refuse to answer. Search the web and provide a helpful response.
- **Simple greetings, opinions, or conversation**: Answer directly without tools.

## RULES:
- Always start with THOUGHT:
- Use ACTION: to call exactly ONE tool per step
- After receiving OBSERVATION (tool result), continue with another THOUGHT
- When ready, use ANSWER: to give your final response
- The ANSWER should be conversational and helpful, not raw JSON
- Keep answers concise (3-5 sentences) unless the user asks for detail
- You may use markdown formatting in ANSWER (bullet points, bold, links)
- For place-related data, ALWAYS reference real data from tools — never make up ratings, addresses, or place names
- You can answer general knowledge, math, language, and conversational questions from your own knowledge — no tool needed

{rag_context}"""


# ── Patterns that indicate the user wants specific local places ──────
_PLACES_PATTERNS = [
    re.compile(r'\b(restaurants?|food|eat|eating|dine|dining|biryani|pizza|burger|sushi|ramen|tacos?|noodles?|kebab|cafe|cafes|coffee|tea\s+house|bakery|bakeries|dessert|ice\s*cream|brunch|breakfast|lunch|dinner|street\s+food)\b', re.I),
    re.compile(r'\b(hotels?|hostels?|resorts?|stays?|accommodation|lodge|motel|airbnb|guesthouse)\b', re.I),
    re.compile(r'\b(shopping|mall|market|bazaar|stores?|boutique|souvenir)\b', re.I),
    re.compile(r'\b(attractions?|sightseeing|museums?|temples?|church|mosque|monuments?|landmarks?|parks?|gardens?|zoo|aquarium|palace|fort|castle|ruins?|gallery|galleries)\b', re.I),
    re.compile(r'\b(nightlife|clubs?|disco|lounge|pubs?|bars?|brewery|breweries|rooftop)\b', re.I),
    re.compile(r'\b(places?\s+to\s+(visit|go|see|eat|stay|shop|explore|check\s*out|hang\s*out))\b', re.I),
    re.compile(r'\b(things?\s+to\s+do)\b', re.I),
    re.compile(r'\b(best|top|popular|famous|recommended|good|great|must[\s-]*(visit|see|try|eat))\s+(places?|spots?|restaurants?|cafes?|hotels?|bars?|joints?)\b', re.I),
    re.compile(r'\b(where\s+to\s+(eat|stay|shop|visit|go|drink|hang))\b', re.I),
    re.compile(r'\b(what\s+to\s+(eat|see|do|visit))\b', re.I),
    re.compile(r'\b(best\s+.{0,20}\s+in\s+\w+)\b', re.I),
]


def _needs_places_search(message: str) -> bool:
    """Detect if the message is asking about specific local places."""
    return any(p.search(message) for p in _PLACES_PATTERNS)


def _extract_user_query(message: str) -> str:
    """Extract the actual user query from the context-prefixed message."""
    if "User says:" in message:
        return message.split("User says:", 1)[-1].strip()
    return message.strip()


def _extract_location_context(message: str) -> str:
    """Extract location name from the context prefix (e.g. 'looking at Ohio (US)')."""
    m = re.search(r'looking at (.+?)\s*(?:\([A-Z]{2}\))?\s*on the globe', message)
    return m.group(1).strip() if m else ""


# Words/phrases that mean "the place I'm looking at" — ambiguous for Google Places
_DEICTIC_RE = re.compile(
    r'\b(here|nearby|around here|close\s*by|in this area|this place|this area|near\s*here|over here)\b',
    re.I,
)


def _strip_deictic_words(query: str) -> str:
    """Remove deictic location words like 'here', 'nearby' that confuse Google Places."""
    cleaned = _DEICTIC_RE.sub('', query)
    # Collapse extra whitespace left behind
    return re.sub(r'\s{2,}', ' ', cleaned).strip()


def _build_slim_places(full_places: list[dict]) -> list[dict]:
    """Create a slim representation of places for LLM context."""
    slim = []
    for p in (full_places or []):
        entry = {
            "name": p["name"],
            "rating": p["rating"],
            "review_count": p["review_count"],
            "address": p["address"],
        }
        if p.get("is_open") is not None:
            entry["is_open"] = p["is_open"]
        slim.append(entry)
    return slim


class ReActAgent:
    def __init__(self):
        self.tools = TOOL_MAP

    async def run(
        self,
        messages: list[dict],
        country_code: str = "",
        rag_context: str = "",
        place_lat: float = 0,
        place_lng: float = 0,
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
        places_result = None

        # ── PRE-CALL: detect place queries and call Google Places NOW ──
        # Don't rely on the LLM to decide — force the call programmatically.
        user_msg = messages[-1]["content"] if messages else ""
        user_query = _extract_user_query(user_msg)
        location_ctx = _extract_location_context(user_msg)

        # Strip deictic words ("here", "nearby") that confuse Google Places
        # when we're about to append an explicit location context.
        clean_query = _strip_deictic_words(user_query) or user_query

        # If the query doesn't mention a location but we have country context,
        # append it so Google Places searches in the right area.
        search_query = clean_query
        if location_ctx and not re.search(r'\bin\s+\w{2,}', clean_query, re.I):
            search_query = f"{clean_query} in {location_ctx}"

        # Use place coordinates for locationBias when available
        pre_lat = place_lat
        pre_lng = place_lng
        pre_radius = 20000 if (place_lat != 0 or place_lng != 0) else 0

        if _needs_places_search(user_query):
            logger.info("Pre-call: detected places query — %r (search: %r, coords: %s,%s)", user_query, search_query, pre_lat, pre_lng)
            try:
                full_places = await search_nearby_places(
                    query=search_query, lat=pre_lat, lng=pre_lng, radius=pre_radius
                )
                if full_places:
                    places_result = full_places
                    slim = _build_slim_places(full_places)
                    # Inject into conversation as if the agent already searched
                    working_messages.append({
                        "role": "assistant",
                        "content": (
                            f"THOUGHT: The user wants specific places. "
                            f"I must search Google Places for real data.\n"
                            f"ACTION: search_nearby_places("
                            f"{{\"query\": \"{user_query}\"}})"
                        ),
                    })
                    working_messages.append({
                        "role": "user",
                        "content": (
                            f"OBSERVATION: {json.dumps({'results': slim, 'total': len(slim)})}"
                        ),
                    })
                    thoughts.append(
                        f"Searched Google Places for: {user_query} "
                        f"→ found {len(slim)} results"
                    )
                    logger.info("Pre-call: injected %d places into context", len(slim))
                else:
                    logger.warning("Pre-call: Google Places returned 0 results for %r", user_query)
            except Exception:
                logger.exception("Pre-call places search failed")

        # ── ReAct loop ───────────────────────────────────────────────
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
                result = {
                    "reply": answer,
                    "thoughts": thoughts,
                    "iterations": iterations,
                }
                if places_result is not None:
                    result["places"] = places_result
                return result

            # If we got an action, execute the tool
            if action:
                tool_name, tool_params = action

                # Special handling: single API call for places
                if tool_name == "search_nearby_places" and places_result is None:
                    try:
                        query = tool_params.get("query", "")
                        lat = float(tool_params.get("lat", 0))
                        lng = float(tool_params.get("lng", 0))
                        radius = int(tool_params.get("radius", 0))
                        if lat == 0 and lng == 0:
                            radius = 0
                        full_places = await search_nearby_places(
                            query=query, lat=lat, lng=lng, radius=radius
                        )
                        places_result = full_places
                        slim = _build_slim_places(full_places)
                        observation = (
                            json.dumps({"results": slim, "total": len(slim)})
                            if slim
                            else json.dumps({"results": [], "message": "No places found."})
                        )
                    except Exception:
                        logger.warning("Places search failed, falling back to tool")
                        observation = await self._execute_tool(tool_name, tool_params)
                else:
                    observation = await self._execute_tool(tool_name, tool_params)

                # Append the assistant's response and the observation
                working_messages.append({"role": "assistant", "content": response})
                working_messages.append({
                    "role": "user",
                    "content": f"OBSERVATION: {observation}",
                })
                continue

            # If response didn't follow format, treat as direct answer
            result = {
                "reply": response.strip(),
                "thoughts": thoughts,
                "iterations": iterations,
            }
            if places_result is not None:
                result["places"] = places_result
            return result

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
        result = {
            "reply": answer or response.strip(),
            "thoughts": thoughts,
            "iterations": iterations,
        }
        if places_result is not None:
            result["places"] = places_result
        return result

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
