# Minimal Dockerfile for send-message.mjs tool
# This Dockerfile is optimized for size and simplicity for a single script tool.

FROM node:18.20.8-slim

WORKDIR /usr/src/app

# Create a minimal package.json with just the required dependency, install it,
# and then clean up. This avoids copying the entire monorepo's node_modules.
RUN echo '{"dependencies": {"amqplib": "0.10.9"}}' > package.json && \
    npm install --omit=dev --ignore-scripts && \
    rm package.json package-lock.json

# Copy the tool script from the build context into the current directory
COPY packages/common-settings-bridge/tools/send-message.mjs .

# Set environment variables with default values.
# These can be overridden at runtime (e.g., `docker run -e RABBITMQ_HOST=my-rabbit ...`)
ENV RABBITMQ_HOST=rabbitmq \
    RABBITMQ_PORT=5672 \
    RABBITMQ_USERNAME=guest \
    RABBITMQ_PASSWORD=guest \
    RABBITMQ_VHOST=/ \
    RABBITMQ_TLS=false \
    EXCHANGE_NAME="settings exchange" \
    ROUTING_KEY="user.settings.updated"

# Run the interactive script
CMD ["node", "send-message.mjs"]
