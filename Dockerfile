FROM node:dubnium
WORKDIR /app
COPY ./public ./public
COPY data.json index.js package.json test.js  ./
RUN npm install --only=prod && npm cache --force clean
EXPOSE 3000
CMD ["node", "./index.js"]
