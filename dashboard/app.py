"""
SilentGuard Admin Dashboard
Streamlit app for hotel managers to monitor crisis events in real-time.
Connects to Firestore and displays a live incident feed with summary stats.
"""

import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
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
    creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if creds_json:
        import json
        cred_dict = json.loads(creds_json)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    elif os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    else:
        st.error("Firebase credentials not found!")
        st.stop()

db = firestore.client()


def get_crisis_events(limit=100):
    events_ref = db.collection("crisisEvents")
    query = events_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit)
    docs = query.stream()
    events = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if data.get("timestamp"):
            data["timestamp"] = data["timestamp"]
        events.append(data)
    return events


def show_login_page():
    st.markdown(
        """
        <div style="text-align: center; padding: 4rem 0;">
            <h1 style="font-size: 3rem;">🛡️ SilentGuard Dashboard</h1>
            <p style="color: #888; margin-bottom: 2rem;">Live operations command center.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    
    col1, col2, col3 = st.columns([1, 1, 1])
    with col2:
        with st.form("login_form"):
            pwd = st.text_input("Master Password", type="password")
            submit = st.form_submit_button("Authenticate", use_container_width=True)
            
            if submit:
                try:
                    expected = st.secrets.get("DASHBOARD_PASSWORD", "silentguard2026")
                except FileNotFoundError:
                    expected = "silentguard2026"
                    
                if pwd == expected:
                    st.session_state["authenticated"] = True
                    st.rerun()
                else:
                    st.error("Access Denied.")


def show_dashboard():
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
        refresh_interval = st.slider("Refresh interval (seconds)", 3, 30, 5)
        max_events = st.slider("Max events to show", 10, 200, 100)
        
        if st.button("Logout"):
            st.session_state["authenticated"] = False
            st.rerun()

        st.divider()
        st.markdown("**SilentGuard** v1.0")
        st.caption("Audio never leaves the device.")

    events = get_crisis_events(limit=max_events)

    if not events:
        st.info("No crisis events recorded yet.")
        if auto_refresh:
            time.sleep(refresh_interval)
            st.rerun()
        return

    df = pd.DataFrame(events)

    # Summary metrics
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Alerts", len(df))
    with col2:
        unique_types = df.get("className", pd.Series([])).nunique()
        st.metric("Crisis Types", unique_types)
    with col3:
        unique_rooms = df.get("roomId", pd.Series([])).nunique()
        st.metric("Rooms Affected", unique_rooms)
    with col4:
        if "confidence" in df.columns:
            st.metric("Avg Confidence", f"{df['confidence'].mean():.1%}")

    st.divider()

    # Charts
    chart_col1, chart_col2 = st.columns(2)
    with chart_col1:
        st.subheader("📊 Alerts by Type")
        if "className" in df.columns:
            st.bar_chart(df["className"].value_counts())
    with chart_col2:
        st.subheader("🏨 Alerts by Room")
        if "roomId" in df.columns:
            st.bar_chart(df["roomId"].value_counts())

    st.divider()
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
        if "Confidence" in display_df.columns:
            display_df["Confidence"] = display_df["Confidence"].apply(lambda x: f"{x:.1%}" if pd.notnull(x) else "—")
        st.dataframe(display_df, use_container_width=True, hide_index=True)
    else:
        st.dataframe(df, use_container_width=True, hide_index=True)

    if auto_refresh:
        time.sleep(refresh_interval)
        st.rerun()


def main():
    if not st.session_state.get("authenticated", False):
        show_login_page()
    else:
        show_dashboard()

if __name__ == "__main__":
    main()
