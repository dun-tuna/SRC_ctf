FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3002

CMD ["sh", "-c", "\
FLAG_NAME=flag_$(head -c 64 /dev/urandom | tr -dc a-zA-Z0-9 | head -c 10) && \
echo \"$FLAG\" > /$FLAG_NAME && \
unset FLAG && \
node app.js \
"]

