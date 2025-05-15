from typing import Dict, List, Optional, TypedDict, Any
from datetime import datetime
import pandas as pd
from langgraph.graph import Graph, StateGraph
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command
from google.cloud import bigquery
from google.oauth2 import service_account


def query_bigquery(query: str):
    print("▶️ get_event_data()")
    credentials = service_account.Credentials.from_service_account_file(
            'service_key.json',
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
    try:
        
        client = bigquery.Client(credentials=credentials)
        job_config = bigquery.QueryJobConfig()
        event_data_df = client.query(query, job_config=job_config).to_dataframe()
    
        result = {
            "data": event_data_df.to_dict(orient='records'),
            "columns": event_data_df.columns.tolist(),
            "row_count": len(event_data_df)
        }
        return result
    except Exception as e:
        error_msg = f"❌ Error fetching event data: {str(e)}"
        print(error_msg)
        return error_msg

