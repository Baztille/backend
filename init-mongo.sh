q_MONGO_USER=`jq --arg v "$DB_USER_USERNAME" -n '$v'`
q_MONGO_PASSWORD=`jq --arg v "$DB_USER_PASSWORD" -n '$v'`
q_DB_NAME=`jq --arg v "$DB_NAME" -n '$v'`
mongo -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" admin <<EOF
    db.getSiblingDB("$DB_NAME").createUser({user: "$DB_USER_USERNAME", pwd: "$DB_USER_PASSWORD", roles: ['readWrite']})
EOF

