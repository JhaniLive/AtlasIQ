from abc import ABC, abstractmethod


class BaseAgent(ABC):
    name: str = "base"

    @abstractmethod
    async def run(self, input_data: dict) -> dict:
        raise NotImplementedError
