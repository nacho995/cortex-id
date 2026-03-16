package dev.cortexid.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for HealthController using @WebMvcTest (no full Spring context).
 * Verifies the /api/health endpoint contract.
 */
@WebMvcTest(HealthController.class)
@Import(dev.cortexid.config.SecurityConfig.class)
@DisplayName("HealthController")
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Nested
    @DisplayName("GET /api/health")
    class GetHealthTests {

        @Test
        @DisplayName("returns HTTP 200 OK")
        void health_shouldReturn200() throws Exception {
            mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("returns status=ok in response body")
        void health_shouldReturnStatusOk() throws Exception {
            mockMvc.perform(get("/api/health"))
                .andExpect(jsonPath("$.status").value("ok"));
        }

        @Test
        @DisplayName("returns correct version in response body")
        void health_shouldReturnCorrectVersion() throws Exception {
            mockMvc.perform(get("/api/health"))
                .andExpect(jsonPath("$.version").value("0.1.0"));
        }

        @Test
        @DisplayName("returns service name in response body")
        void health_shouldReturnServiceName() throws Exception {
            mockMvc.perform(get("/api/health"))
                .andExpect(jsonPath("$.service").value("cortex-id-backend"));
        }

        @Test
        @DisplayName("returns numeric timestamp in response body")
        void health_shouldReturnNumericTimestamp() throws Exception {
            mockMvc.perform(get("/api/health"))
                .andExpect(jsonPath("$.timestamp").isNumber());
        }

        @Test
        @DisplayName("returns Content-Type application/json")
        void health_shouldReturnJsonContentType() throws Exception {
            mockMvc.perform(get("/api/health"))
                .andExpect(content().contentTypeCompatibleWith("application/json"));
        }

        @Test
        @DisplayName("returns all required fields in a single request")
        void health_shouldReturnAllRequiredFields() throws Exception {
            mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.version").value("0.1.0"))
                .andExpect(jsonPath("$.service").value("cortex-id-backend"))
                .andExpect(jsonPath("$.timestamp").isNumber());
        }
    }
}
