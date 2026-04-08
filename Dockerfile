FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm ci

COPY . .

ENV NODE_ENV=production

RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY --from=build /app /app

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "run", "start"]
