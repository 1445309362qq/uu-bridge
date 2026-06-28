FROM node:24-slim

# Python for edge-tts
RUN apt-get update && apt-get install -y python3 python3-pip && \
    pip3 install edge-tts --break-system-packages && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# pm2 守护
RUN npm install -g pm2

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
