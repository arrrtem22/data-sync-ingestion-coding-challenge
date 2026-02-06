FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Install postgresql-client for psql COPY support
RUN apk add --no-cache postgresql-client

COPY . .

# Create data directory for state file
RUN mkdir -p /data

CMD ["npm", "start"]
