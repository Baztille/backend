#!/bin/sh

# Note: this script is designed to be used only within the built container for production, not in dev environment

echo "Baztile backend starting script"
date

echo "Login into Infisical..."
export INFISICAL_TOKEN=$(infisical login --method=universal-auth --client-id=$INFISICAL_CLIENT_ID --client-secret=$INFISICAL_SECRET --plain --silent)

echo "Starting application..."
infisical run --projectId $INFISICAL_PROJECT_ID --env prod -- node dist/src/main >/var/log/backend_command_output.log 2>&1

echo "Unsetting sensitive variables"
unset INFISICAL_TOKEN
unset INFISICAL_CLIENT_ID
unset INFISICAL_SECRET
unset INFISICAL_PROJECT_ID
