FROM node:24-slim AS builder
WORKDIR /build
RUN apt-get update
RUN apt-get install -y git python3 build-essential
COPY . .
RUN npm ci --production

FROM node:24-slim
WORKDIR /build
RUN apt-get update
RUN apt-get install -y firefox-esr pngcrush cron ca-certificates
COPY --from=builder /build .
# Start with a fresh .env from the sample (no secrets baked into the image).
ADD .env.sample .env
RUN mkdir -p /build/data && echo "PATH=/bin:/usr/bin:/usr/local/bin\n* * * * * root /bin/bash /build/cron.sh > /build/cron.log\n#" | crontab -
EXPOSE 3030
# Start cron (scheduled screenshots) *at runtime*, then run the web server.
CMD ["sh", "-c", "service cron start && exec npm start"]

# docker build --load -t kindle-display .
# docker run --name kindle-display -p 3030:3030 -it kindle-display
# docker exec -it kindle-display bash
