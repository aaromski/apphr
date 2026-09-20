# Implementation Plan

## Task Dependencies
- Task 1 (Exploration test) must be completed BEFORE Task 3 (Implementation)
- Task 2 (Preservation tests) must be completed BEFORE Task 3 (Implementation)
- Task 3.2 and 3.3 depend on Task 1 and Task 2 tests respectively

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Timer Synchronization Desynchronization
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate timer desynchronization between client and server timestamps
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to concrete failing cases:
    - Simulate client clock 30 seconds ahead of server
    - Simulate 2-second network latency between client timestamp and server recording
    - Simulate page refresh after timer start
  - Test implementation details from Bug Condition in design:
    - `isBugCondition` returns true when `clientGeneratedTimestamp != serverRecordedTimestamp`
    - Use `Date.now()` for client timestamp vs server timestamp for storage
  - The test assertions should match the Expected Behavior Properties from design:
    - Single authoritative timestamp source should be used
    - Client display time should equal server storage time
    - Timer should be consistent after page refresh
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "timer shows 00:30 elapsed, DB shows 00:25 after refresh")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Immediate Visual Feedback and Timer Functionality
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `isBugCondition` returns false):
    - Immediate visual feedback when "Iniciar Limpieza" clicked (timer starts within 100ms)
    - Real-time elapsed time updates every second during cleaning sessions
    - Accurate duration calculation when cleaning sessions end
    - Concurrent cleaning session handling for multiple users
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all non-buggy inputs, timer should start within 100ms of button click
    - For all non-buggy inputs, timer should update every second with accurate elapsed time
    - For all non-buggy inputs, SLA violation detection should work correctly
    - For all non-buggy inputs, progress bars and visual indicators should update properly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix timer synchronization bug in `app/limpieza/page.tsx`

  - [ ] 3.1 Implement server timestamp retrieval API endpoint
    - Create `/api/timestamp` endpoint that returns current server time
    - Endpoint should return ISO 8601 timestamp with millisecond precision
    - Include server clock information and latency measurement
    - Implement error handling and fallback mechanism
    - Add request timing headers to measure round-trip latency
    - _Bug_Condition: isBugCondition(input) where clientGeneratedTimestamp != serverRecordedTimestamp_
    - _Expected_Behavior: Single authoritative timestamp source from server for both client and server_
    - _Preservation: Must not affect existing API performance or introduce noticeable delay_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [ ] 3.2 Update `handleStartCleaning()` function to use server timestamp
    - Modify function to fetch server timestamp before optimistic update
    - Replace `Date.now()` with server timestamp for `optimisticStartMs`
    - Use same server timestamp for `iniciado_at` in database upsert
    - Store authoritative timestamp in `cleaningStarts` state
    - Implement network latency compensation:
      - Measure time between request initiation and response receipt
      - Adjust client display if significant latency detected (>100ms)
      - Add timestamp correction mechanism for large discrepancies
    - Implement fallback to client timestamp with warning if server fetch fails
    - Log timestamp discrepancies for monitoring and debugging
    - _Bug_Condition: isBugCondition(input) where usesClientClockForDisplay = true AND usesServerClockForStorage = true_
    - _Expected_Behavior: expectedBehavior(result) from design - usesSingleTimestampSource = true_
    - _Preservation: Preservation Requirements from design - immediate visual feedback maintained_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 3.3 Update state management for synchronized timestamps
    - Modify `cleaningStarts` state to store server-authoritative timestamps
    - Update timer calculation functions to use server timestamps
    - Adjust real-time subscription handling to use synchronized timestamps
    - Ensure all timer display logic uses consistent timestamp source
    - Update progress bar calculations to use server timestamps
    - Modify SLA violation detection to use synchronized timestamps
    - _Bug_Condition: isBugCondition(input) where clientDisplayTime != serverStorageTime_
    - _Expected_Behavior: expectedBehavior(result) - timerConsistentAfterRefresh = true_
    - _Preservation: Preservation Requirements - real-time updates and duration accuracy maintained_
    - _Requirements: 2.2, 2.3, 3.2, 3.3_

  - [ ] 3.4 Implement fallback and error handling mechanisms
    - Add retry logic for timestamp fetch failures (max 2 retries)
    - Implement client timestamp fallback with user notification
    - Add monitoring for timestamp discrepancies > 1 second
    - Create admin dashboard for viewing timestamp synchronization status
    - Implement automatic timestamp correction for small discrepancies
    - Add logging for all timestamp synchronization events
    - _Bug_Condition: isBugCondition(input) where network latency causes timestamp gap_
    - _Expected_Behavior: expectedBehavior(result) - networkLatencyCompensated = true_
    - _Preservation: Preservation Requirements - system remains functional even with timestamp issues_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.4_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Timer Synchronization Fixed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify:
      - Single authoritative timestamp source is used
      - Client display time equals server storage time
      - Timer is consistent after simulated page refresh
      - Clock differences no longer cause desynchronization
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3)_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Immediate Visual Feedback and Timer Functionality
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix:
      - Immediate visual feedback maintained (timer starts within 100ms)
      - Real-time updates every second still work
      - Duration calculation accuracy preserved
      - Concurrent session handling unaffected
      - SLA tracking still works correctly
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run comprehensive test suite including:
    - Bug condition exploration tests (Property 1)
    - Preservation property tests (Property 2)
    - Unit tests for server timestamp API
    - Unit tests for updated `handleStartCleaning()` function
    - Integration tests for full cleaning flow
    - Property-based tests for random scenarios
  - Verify no test failures or regressions
  - Ensure timer synchronization works end-to-end:
    - Start cleaning → monitor → complete → refresh
    - Multiple concurrent sessions
    - Network latency scenarios
    - Server timestamp fetch failures
  - Confirm SLA violation detection works with synchronized timestamps
  - Validate real-time updates maintain timer consistency
  - Ask the user if questions arise during final verification