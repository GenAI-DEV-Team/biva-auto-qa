FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements and install dependencies. Source code will be bind-mounted.
COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 13886

# Command will be overridden in docker-compose.yml
