ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginx:stable-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_MAP_STYLE_DAY=
ARG VITE_MAP_STYLE_NIGHT=
# Fixture mode is never a production build argument.
ENV VITE_USE_FIXTURES=false
RUN npm run build
FROM ${NGINX_IMAGE}
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/nginx.conf
USER nginx
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
