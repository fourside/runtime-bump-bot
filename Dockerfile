FROM node:20-alpine
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat && apk update

ARG PERSONAL_ACCESS_TOKEN
ENV PERSONAL_ACCESS_TOKEN=$PERSONAL_ACCESS_TOKEN

WORKDIR /app

COPY . .

RUN npm ci

CMD ["npm", "start"]
