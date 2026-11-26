FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/sdk/package*.json ./packages/sdk/

RUN npm ci

COPY packages/sdk/ ./packages/sdk/
RUN npm --prefix packages/sdk run build

COPY apps/api/ ./apps/api/
RUN npm --prefix apps/api run build

EXPOSE 4000
CMD ["npm", "--prefix", "apps/api", "start"]
