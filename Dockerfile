FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3333

CMD ["node", "dist/server.js"]