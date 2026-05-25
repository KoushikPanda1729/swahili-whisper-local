FROM python:3.11-slim

# Install Node.js 20, ffmpeg, and build tools
RUN apt-get update && apt-get install -y \
    curl ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install openai-whisper
RUN pip install --no-cache-dir openai-whisper

# Pre-download the model so first request isn't slow
RUN python -c "import whisper; whisper.load_model('large-v3-turbo')"

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads outputs

EXPOSE 4000

CMD ["node", "server.js"]
