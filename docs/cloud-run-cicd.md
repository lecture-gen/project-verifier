# Cloud Run CI/CD

`main` 브랜치에 push하면 GitHub Actions가 production Cloud Run 서비스를 배포한다.

## 대상

- Project: `elysium-ai-ifnvh`
- Region: `asia-east1`
- Domain: `https://dialearn.everyi.ai`
- Services:
  - `dialearn-web` - Next.js
  - `dialearn-api` - FastAPI
  - `dialearn-qdrant` - Qdrant

Workflow: `.github/workflows/deploy-cloud-run.yml`

## GitHub Secrets

Repository Settings -> Secrets and variables -> Actions -> Repository secrets에 추가한다.

| Name | Value |
| --- | --- |
| `GCP_PROJECT_ID` | `elysium-ai-ifnvh` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | GitHub OIDC provider resource name |
| `GCP_SERVICE_ACCOUNT` | `github-cloud-run-deployer@elysium-ai-ifnvh.iam.gserviceaccount.com` |
| `OPENAI_API_KEY` | OpenAI API key |

`OPENAI_API_KEY`는 workflow가 Google Secret Manager의 `OPENAI_API_KEY` secret으로 동기화한다. Cloud Run API 서비스에는 평문 env가 아니라 Secret Manager 참조로 연결된다.

`GCP_WORKLOAD_IDENTITY_PROVIDER` 값:

```text
projects/260775404143/locations/global/workloadIdentityPools/github-actions/providers/project-verifier
```

## 배포용 Service Account 권한

`GCP_SERVICE_ACCOUNT`에는 다음 project-level 권한이 필요하다.

```text
roles/run.admin
roles/cloudbuild.builds.editor
roles/artifactregistry.admin
roles/secretmanager.admin
roles/iam.serviceAccountUser
roles/serviceusage.serviceUsageAdmin
roles/storage.objectAdmin
```

이미 필요한 Google Cloud API가 활성화되어 있으면 `roles/serviceusage.serviceUsageAdmin`은 제거할 수 있다.

그리고 `lecture-gen/project-verifier` GitHub OIDC principal에는 `GCP_SERVICE_ACCOUNT`에 대한 `roles/iam.workloadIdentityUser` binding이 필요하다.

이 프로젝트는 조직 정책상 service account JSON key 생성이 차단되어 있으므로, GitHub Actions는 key 파일 대신 Workload Identity Federation으로 인증한다.

## 동작 순서

1. GitHub Secrets 유효성 확인
2. GitHub OIDC로 Google Cloud 인증
3. 필요한 Google Cloud API 활성화
4. GitHub Secret `OPENAI_API_KEY`를 Secret Manager `OPENAI_API_KEY`로 동기화
5. `dialearn-qdrant` 배포
6. Qdrant URL을 읽어 `dialearn-api` 배포
7. API URL을 읽어 `dialearn-web` 배포
8. `dialearn.everyi.ai`, API `/health`, Qdrant `/collections`, CORS preflight smoke test

## 주의

- 현재 `dialearn-api`는 SQLite와 artifact 파일을 Cloud Run 컨테이너 파일시스템에 둔다. `min-instances=1`, `max-instances=1`로 데모 안정성을 높였지만, 재배포/재시작 시 영속성은 보장되지 않는다.
- `dialearn-qdrant`도 Cloud Run 컨테이너 파일시스템 기반이다. 운영 수준 영속성이 필요하면 Qdrant Cloud 또는 별도 persistent storage로 옮겨야 한다.
- 조직 정책상 `allUsers` IAM binding이 막혀 있어 workflow는 `--no-invoker-iam-check`를 사용한다.
