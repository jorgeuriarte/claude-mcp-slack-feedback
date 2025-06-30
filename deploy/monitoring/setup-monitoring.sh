#!/bin/bash

# Setup monitoring for Claude MCP Slack Feedback on Google Cloud Functions

set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-""}
FUNCTION_NAME=${FUNCTION_NAME:-"claude-mcp-slack-feedback"}
REGION=${GCP_REGION:-"europe-west1"}
NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up monitoring for Cloud Function: $FUNCTION_NAME${NC}"

# Check prerequisites
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable not set${NC}"
    exit 1
fi

if [ -z "$NOTIFICATION_EMAIL" ]; then
    echo -e "${YELLOW}Warning: NOTIFICATION_EMAIL not set. Alerts will not be sent.${NC}"
fi

# Set project
gcloud config set project $PROJECT_ID

# Create notification channel if email is provided
if [ -n "$NOTIFICATION_EMAIL" ]; then
    echo "Creating notification channel..."
    CHANNEL_ID=$(gcloud alpha monitoring channels create \
        --display-name="MCP Slack Feedback Alerts" \
        --type=email \
        --channel-labels=email_address=$NOTIFICATION_EMAIL \
        --format="value(name)" 2>/dev/null || echo "")
    
    if [ -n "$CHANNEL_ID" ]; then
        echo -e "${GREEN}Created notification channel: $CHANNEL_ID${NC}"
    else
        echo -e "${YELLOW}Notification channel may already exist${NC}"
        # List existing channels
        CHANNEL_ID=$(gcloud alpha monitoring channels list \
            --filter="displayName='MCP Slack Feedback Alerts'" \
            --format="value(name)" | head -1)
    fi
fi

# Create uptime check
echo "Creating uptime check..."
gcloud monitoring uptime create \
    --display-name="MCP Slack Feedback Health Check" \
    --resource-type="cloud-function" \
    --function-name="$FUNCTION_NAME" \
    --region="$REGION" \
    --path="/health" \
    --check-interval="5m" \
    --timeout="10s" || echo "Uptime check may already exist"

# Create alert policies
echo "Creating alert policies..."

# High error rate alert
cat > /tmp/error-rate-policy.json << EOF
{
  "displayName": "MCP Slack Feedback - High Error Rate",
  "conditions": [
    {
      "displayName": "Error rate > 5%",
      "conditionThreshold": {
        "filter": "resource.type=\\\"cloud_function\\\" AND resource.labels.function_name=\\\"$FUNCTION_NAME\\\" AND metric.type=\\\"cloudfunctions.googleapis.com/function/execution_count\\\" AND metric.labels.status!=\\\"ok\\\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.05,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_RATE"
          }
        ]
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "1800s"
  }
}
EOF

if [ -n "$CHANNEL_ID" ]; then
    jq ".notificationChannels = [\"$CHANNEL_ID\"]" /tmp/error-rate-policy.json > /tmp/error-rate-policy-with-channel.json
    gcloud alpha monitoring policies create --policy-from-file=/tmp/error-rate-policy-with-channel.json || echo "Error rate policy may already exist"
else
    gcloud alpha monitoring policies create --policy-from-file=/tmp/error-rate-policy.json || echo "Error rate policy may already exist"
fi

# High latency alert
cat > /tmp/latency-policy.json << EOF
{
  "displayName": "MCP Slack Feedback - High Latency",
  "conditions": [
    {
      "displayName": "95th percentile latency > 30s",
      "conditionThreshold": {
        "filter": "resource.type=\\\"cloud_function\\\" AND resource.labels.function_name=\\\"$FUNCTION_NAME\\\" AND metric.type=\\\"cloudfunctions.googleapis.com/function/execution_times\\\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 30000,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_PERCENTILE_95"
          }
        ]
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "1800s"
  }
}
EOF

if [ -n "$CHANNEL_ID" ]; then
    jq ".notificationChannels = [\"$CHANNEL_ID\"]" /tmp/latency-policy.json > /tmp/latency-policy-with-channel.json
    gcloud alpha monitoring policies create --policy-from-file=/tmp/latency-policy-with-channel.json || echo "Latency policy may already exist"
else
    gcloud alpha monitoring policies create --policy-from-file=/tmp/latency-policy.json || echo "Latency policy may already exist"
fi

# Memory usage alert
cat > /tmp/memory-policy.json << EOF
{
  "displayName": "MCP Slack Feedback - High Memory Usage",
  "conditions": [
    {
      "displayName": "Memory usage > 80%",
      "conditionThreshold": {
        "filter": "resource.type=\\\"cloud_function\\\" AND resource.labels.function_name=\\\"$FUNCTION_NAME\\\" AND metric.type=\\\"cloudfunctions.googleapis.com/function/user_memory_bytes\\\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.8,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_MAX"
          },
          {
            "crossSeriesReducer": "REDUCE_FRACTION_TRUE",
            "groupByFields": ["resource.label.function_name"]
          }
        ]
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "1800s"
  }
}
EOF

if [ -n "$CHANNEL_ID" ]; then
    jq ".notificationChannels = [\"$CHANNEL_ID\"]" /tmp/memory-policy.json > /tmp/memory-policy-with-channel.json
    gcloud alpha monitoring policies create --policy-from-file=/tmp/memory-policy-with-channel.json || echo "Memory policy may already exist"
else
    gcloud alpha monitoring policies create --policy-from-file=/tmp/memory-policy.json || echo "Memory policy may already exist"
fi

# Create custom dashboard
echo "Creating monitoring dashboard..."
cat > /tmp/dashboard.json << EOF
{
  "displayName": "MCP Slack Feedback Dashboard",
  "gridLayout": {
    "widgets": [
      {
        "title": "Function Invocations",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\\\"cloud_function\\\" AND resource.labels.function_name=\\\"$FUNCTION_NAME\\\" AND metric.type=\\\"cloudfunctions.googleapis.com/function/execution_count\\\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_RATE"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Error Rate",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\\\"cloud_function\\\" AND resource.labels.function_name=\\\"$FUNCTION_NAME\\\" AND metric.type=\\\"cloudfunctions.googleapis.com/function/execution_count\\\" AND metric.labels.status!=\\\"ok\\\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_RATE"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Execution Time (95th percentile)",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\\\"cloud_function\\\" AND resource.labels.function_name=\\\"$FUNCTION_NAME\\\" AND metric.type=\\\"cloudfunctions.googleapis.com/function/execution_times\\\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_PERCENTILE_95"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Memory Usage",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\\\"cloud_function\\\" AND resource.labels.function_name=\\\"$FUNCTION_NAME\\\" AND metric.type=\\\"cloudfunctions.googleapis.com/function/user_memory_bytes\\\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_MAX"
                }
              }
            }
          }]
        }
      }
    ]
  }
}
EOF

gcloud monitoring dashboards create --config-from-file=/tmp/dashboard.json || echo "Dashboard may already exist"

# Clean up temp files
rm -f /tmp/error-rate-policy*.json /tmp/latency-policy*.json /tmp/memory-policy*.json /tmp/dashboard.json

echo -e "${GREEN}Monitoring setup complete!${NC}"
echo ""
echo "View your dashboard at:"
echo "https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
echo "View function logs with:"
echo "gcloud functions logs read $FUNCTION_NAME --region=$REGION"