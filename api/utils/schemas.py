from typing import Dict, List

from pydantic import BaseModel, Field

from .tools import WEATHER_TOOL  # Import the constant


class WeatherToolSchema(BaseModel):
    """Schema for the get_current_weather tool."""
    latitude: float = Field(..., description="The latitude of the location")
    longitude: float = Field(..., description="The longitude of the location")

# Define tool schema and metadata mapping
TOOL_DEFINITIONS = {
    WEATHER_TOOL: {  # Use constant instead of string
        "schema": WeatherToolSchema,
        "description": "Get the current weather at a location"
    }
}

# Get tool definitions for API
def get_tool_definitions() -> List[Dict]:
    """Get the tool definitions in OpenAI format for API calls."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool_name,
                "description": tool_info["description"],
                "parameters": tool_info["schema"].model_json_schema(),
            },
        }
        for tool_name, tool_info in TOOL_DEFINITIONS.items()
    ]