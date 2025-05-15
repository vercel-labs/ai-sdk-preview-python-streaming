import datetime
from zoneinfo import ZoneInfo
from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import google_search  # Import the tool
from typing import Union, List, Optional, Iterable
import os
import json
import gzip

import io

# ────────────────────────────────────────────────────────────────────────────
# 1. Tools
# ────────────────────────────────────────────────────────────────────────────
# moved Mixpanel tool to its own file
from .tools.bigquery_tools import query_bigquery


#moved prompts to a separate file
from .prompts import (
 
    ROOT_AGENT_INSTRUCTION,
    GOOGLE_SEARCH_AGENT_INSTRUCTION,
    BIGQUERY_QUERY_RUNNER_AGENT_INSTRUCTION,
    GET_BIGQUERY_QUERY_AGENT_INSTRUCTION,
)


bigquery_query_runner_agent = Agent(
    name="bigquery_query_runner_agent",
    model="gemini-2.0-flash",
    description="Builds & executes the BigQuery query, returns raw rows.",
    instruction=BIGQUERY_QUERY_RUNNER_AGENT_INSTRUCTION,
    tools=[query_bigquery],
    output_key="bigquery_data"
)



get_bigquery_query_agent = Agent(
    name="get_bigquery_query_agent",
    model="gemini-2.0-flash",
    description="Returns the BigQuery SQL query to use with bigquery_query_runner_agent which queries the table.",
    instruction=GET_BIGQUERY_QUERY_AGENT_INSTRUCTION,
    tools=[AgentTool(agent=bigquery_query_runner_agent)],
    output_key="bigquery_query"
)


# google search agent
google_search_agent = Agent(
    model='gemini-2.0-flash-exp',
    name='google_search_agent',
    instruction=GOOGLE_SEARCH_AGENT_INSTRUCTION,
    tools=[google_search]
)

# ────────────────────────────────────────────────────────────────────────────
# 3. Root orchestration agent
# ────────────────────────────────────────────────────────────────────────────

root_agent_x = Agent(
    name="agent_router",
    model="gemini-2.0-flash",
    description="Job is to route the user's request to the right sub-agent.",
    instruction=ROOT_AGENT_INSTRUCTION,
    sub_agents=[
        get_bigquery_query_agent,
    ],
    tools=[
        AgentTool(agent=google_search), 
    ]
)


root_agent = Agent(
    name="agent_router",
    model="gemini-2.0-flash-live-001",
    description="Job is to route the user's request to the right sub-agent.",
    instruction=ROOT_AGENT_INSTRUCTION
)

