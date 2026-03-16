FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY pom.xml ./
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/target/cortex-id-backend.jar ./cortex-id-backend.jar

ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 7432

ENTRYPOINT ["java", "-jar", "/app/cortex-id-backend.jar"]
