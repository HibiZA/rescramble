# Stage 1: Build (bundle + minify JS)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY src/ ./src/
RUN npx esbuild src/main.js --bundle --minify --outfile=dist/game.js --format=esm

# Stage 2: Serve
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/rescramble.conf

# Copy production HTML + bundled JS + favicon
COPY index.prod.html /usr/share/nginx/html/index.html
COPY --from=build /app/dist/game.js /usr/share/nginx/html/game.js
COPY favicon.svg /usr/share/nginx/html/favicon.svg

# Pre-create temp directories
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1
