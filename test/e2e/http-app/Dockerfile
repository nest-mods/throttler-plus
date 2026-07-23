FROM node:24-alpine

WORKDIR /workspace

COPY package.json package.tgz ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm install --package-lock=false

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY test ./test

RUN npm run build

CMD ["npm", "run", "test:e2e", "--", "--runInBand"]
