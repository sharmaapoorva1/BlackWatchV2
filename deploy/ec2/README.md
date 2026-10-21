# EC2 host monitoring — setup (Phase A)

Flow: **reporter agent on each EC2 → direct HTTPS durable ingress or SQS compatibility path → BlackWatch**.
No SSH or inbound EC2 access is required. SQS remains the rollback path while
direct HTTPS is canaried.

## 1. Create the AWS side (once)
```powershell
cd deploy\ec2
$env:REGION = "us-west-1" ; .\setup.ps1
```
Prints the **agent queue URL** and the **agent policy ARN** (`blackwatch-ec2-agent-send`),
and extends the `blackwatch-sqs-reader` user to poll the queue.

## 2. Let each EC2 send to the queue
Attach the **agent policy** to each instance's IAM role:
```bash
# find the role behind the instance's profile, then attach:
aws iam attach-role-policy --role-name <INSTANCE_ROLE> \
  --policy-arn arn:aws:iam::<ACCT>:policy/blackwatch-ec2-agent-send
```
(If an instance has no role, create one + instance profile and associate it — live, no reboot.)

## 3. Install the agent on each EC2 (run as root)
Copy both `scripts/ec2_agent.py` and `scripts/agent_transport.py` plus this
installer (or copy the repo's `scripts/` + `deploy/` tree), then:
```bash
sudo BLACKWATCH_SQS_URL="<queue url from step 1>" AWS_REGION="us-west-1" bash deploy/ec2/install-agent.sh
```
Verify: `journalctl -u blackwatch-agent -f` should show `reported instance=i-... auth_lines=N`.

For the Phase 2 canary, configure the server's `BLACKWATCH_AGENT_TOKENS` and
install one non-critical host with:

```bash
sudo BLACKWATCH_TRANSPORT=https \
  BLACKWATCH_INGEST_URL="https://<blackwatch-host>/api/agent/v1/reports" \
  BLACKWATCH_AGENT_TOKEN="<token-for-this-instance>" \
  BLACKWATCH_ROLLOUT="phase3-canary" \
  CRITICAL_INTERVAL_SEC="2" \
  bash deploy/ec2/install-agent.sh
```

The token is stored root-only in `/etc/blackwatch-agent.env`. To roll back:
set `BLACKWATCH_TRANSPORT=sqs` with the original queue URL and rerun the
installer; do not remove the agent spool or the BlackWatch ingress volume.

Phase 3 reports expose the selected transport and rollout label, while the
ingress diagnostics report acceptance/processing p95 latency, retry and
quarantine counts, and oldest active queue age. Tune `CRITICAL_INTERVAL_SEC`
only after measuring CPU, network, and acceptance latency on the canary.

## 4. Wire BlackWatch (UI)
Settings → **Add SQS connector**:
- **Target module** = `ec2.host`
- **SQS queue URL** = the agent queue URL
- **Region** = `us-west-1` (credentials come from the BlackWatch EC2 instance role)
→ **Test** → **Enable**.

(The `blackwatch-sqs-reader` user already has read access from step 1, mounted as the
`blackwatch` profile — same credential the CloudTrail connector uses.)

## 5. Verify
Open **/ui/hosts** — your instances appear as **reporting**. SSH into one (or run `sudo`),
and within ~1–2 min the login shows under "Recent access". Stop the agent
(`systemctl stop blackwatch-agent`) and after ~3 min you'll get a **host.agent.stale** (high) alert.
