FROM node:20-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production

COPY index.js db.js ./
RUN mkdir -p /app/data && chown -R app:app /app

USER app
EXPOSE 3000
CMD ["node", "index.js"]
