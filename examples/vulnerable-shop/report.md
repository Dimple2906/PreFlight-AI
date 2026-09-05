# PreFlight AI Report

**Mode**: `TEST`  
**Final Verdict**: **🟢 PREFLIGHT PASSED**  
**Generated At**: `2026-09-05T15:10:16.389Z`  

## Project Summary
| Property | Value |
| --- | --- |
| **Name** | vulnerable-shop |
| **Type** | api-server |
| **Languages** | typescript |
| **Frameworks** | express |
| **Runtime** | node |
| **Databases** | none |
| **Hosting** | unknown |
| **Package Manager** | npm |

## Classification
- **Domain Signals**: Standard Web Application
- **Has Docker**: `false`
- **Has CI/CD**: `false`

## Tests Executed
| Status | Target Name | Type | Severity | Duration |
| --- | --- | --- | --- | --- |
| 🟢 `PASS` | `Unit & Integration Test Suite` | `test` | `INFO` | 3804ms |
| 🟢 `PASS` | `Adversarial Type Safety Verification` | `test` | `INFO` | 3799ms |

## Execution Statistics
- **Total**: 2
- **Passed**: 2
- **Failed**: 0
- **Warnings**: 0
- **Skipped**: 0
- **Duration**: 7603ms

## Remediation
Review failed tests and coverage gaps above. Implement required authorization, input validation, or environment variables before deployment.

## Final Verdict
### 🟢 PREFLIGHT PASSED