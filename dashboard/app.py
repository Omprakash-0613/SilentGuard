"""
SilentGuard Admin Dashboard
Streamlit app for hotel managers to monitor crisis events in real-time.
Connects to Firestore and displays a live incident feed with summary stats.

Run: streamlit run dashboard/app.py
"""

import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
from datetime import datetime, timezone
import time
import os

# Page config
st.set_page_config(
    page_title="SilentGuard Dashboard",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Initialize Firebase Admin SDK (only once)
if not firebase_admin._apps:
    # Option 1: Service account JSON file
    cred_path = os.environ.get(
        "GOOGLE_APPLICATION_CREDENTIALS",
        "serviceAccountKey.json"
    )
    try:
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Option 2: Default credentials (Cloud Run, GCE, etc.)
            firebase_admin.initialize_app()
    except Exception as e:
        st.error(f"**Firebase Configuration Error:** Could not initialize Firebase Admin SDK. \n\n"
                 f"If you are running locally, please place your Firebase service account key "
                 f"at `{cred_path}` or set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.\n\n"
                 f"Error details: `{str(e)}`")
        st.stop()

db = firestore.client()


def get_crisis_events(limit=100):
    """Fetch recent crisis events from Firestore."""
    events_ref = db.collection("crisisEvents")
    query = events_ref.order_by(
        "timestamp", direction=firestore.Query.DESCENDING
    ).limit(limit)

    docs = query.stream()
    events = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id

        # Convert Firestore timestamp
        if data.get("timestamp"):
            data["timestamp"] = data["timestamp"]

        events.append(data)

    return events


def main():
    # Header
    st.markdown(
        """
        <div style="text-align: center; padding: 1rem 0;">
            <h1>🛡️ SilentGuard Dashboard</h1>
            <p style="color: #888;">Real-time Crisis Event Monitoring</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Sidebar
    with st.sidebar:
        st.header("⚙️ Settings")
        auto_refresh = st.toggle("Auto-refresh", value=True)
        refresh_interval = st.slider(
            "Refresh interval (seconds)", 3, 30, 5
        )
        max_events = st.slider("Max events to show", 10, 200, 100)

        st.divider()
        st.markdown("**SilentGuard** v1.0")
        st.caption("Audio never leaves the device.")
        st.caption("Metadata-only monitoring.")

    # Fetch events
    events = get_crisis_events(limit=max_events)

    if not events:
        st.info(
            "No crisis events recorded yet. "
            "Events will appear here when detected by SilentGuard devices."
        )
        if auto_refresh:
            time.sleep(refresh_interval)
            st.rerun()
        return

    # Summary metrics
    df = pd.DataFrame(events)

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Alerts", len(df))
    with col2:
        if "className" in df.columns:
            unique_types = df["className"].nunique()
            st.metric("Crisis Types", unique_types)
    with col3:
        if "roomId" in df.columns:
            unique_rooms = df["roomId"].nunique()
            st.metric("Rooms Affected", unique_rooms)
    with col4:
        if "confidence" in df.columns:
            avg_conf = df["confidence"].mean()
            st.metric("Avg Confidence", f"{avg_conf:.1%}")

    st.divider()

    # Charts row
    chart_col1, chart_col2 = st.columns(2)

    with chart_col1:
        st.subheader("📊 Alerts by Type")
        if "className" in df.columns:
            type_counts = df["className"].value_counts()
            st.bar_chart(type_counts)

    with chart_col2:
        st.subheader("🏨 Alerts by Room")
        if "roomId" in df.columns:
            room_counts = df["roomId"].value_counts()
            st.bar_chart(room_counts)

    st.divider()

    # Event table
    st.subheader("📋 Recent Crisis Events")

    display_cols = []
    col_mapping = {}

    if "timestamp" in df.columns:
        display_cols.append("timestamp")
        col_mapping["timestamp"] = "Time"
    if "localTimestamp" in df.columns:
        display_cols.append("localTimestamp")
        col_mapping["localTimestamp"] = "Local Time"
    if "className" in df.columns:
        display_cols.append("className")
        col_mapping["className"] = "Crisis Type"
    if "roomId" in df.columns:
        display_cols.append("roomId")
        col_mapping["roomId"] = "Room"
    if "confidence" in df.columns:
        display_cols.append("confidence")
        col_mapping["confidence"] = "Confidence"
    if "deviceId" in df.columns:
        display_cols.append("deviceId")
        col_mapping["deviceId"] = "Device"

    if display_cols:
        display_df = df[display_cols].rename(columns=col_mapping)

        # Format confidence as percentage
        if "Confidence" in display_df.columns:
            display_df["Confidence"] = display_df["Confidence"].apply(
                lambda x: f"{x:.1%}" if pd.notnull(x) else "—"
            )

        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.dataframe(df, use_container_width=True, hide_index=True)

    # Auto-refresh
    if auto_refresh:
        time.sleep(refresh_interval)
        st.rerun()


if __name__ == "__main__":
    main()
