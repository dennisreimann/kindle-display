FROM node:14-buster-slim AS builder
WORKDIR /build
RUN apt-get update
RUN apt-get install -y git python3 build-essential
COPY . .
RUN npm ci --production

FROM node:14-buster-slim
WORKDIR /build
RUN apt-get update
RUN apt-get install -y firefox-esr pngcrush jo jq torsocks curl cron
COPY --from=builder /build .
ADD .env.sample .env
RUN echo "PATH=/bin:/usr/bin:/usr/local/bin\n* * * * * root /bin/bash /build/cron.sh > /build/cron.log\n#" | crontab -
RUN service cron start
EXPOSE 3030
CMD ["npm", "start"]


# docker build -t kindle-display .
# docker run --name kindle-display -p 3030:3030 -it kindle-display
# docker exec -it kindle-display bash
