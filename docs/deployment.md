# Separate user service

Do not run this on IdentityMD infrastructure. No services were installed or activated during this task. The shipped service is an optional **one-shot simulation**, not a live daemon.

1. Copy source to a separate user's machine with Node 24. No dependency install is needed. Run the offline tests.
2. Copy the JSON config outside the checkout, set absolute `stateDirectory` and `emergencyFile`, and keep the working directory at the source root. Each new demonstration needs a fresh state directory; preserve completed histories.
3. Adapt `deploy/paper-dry-run.service` to actual absolute paths for Node, source and config; do not copy literal placeholders. Install under that user's systemd user-service directory. Review it, then start manually with `systemctl --user start paper-dry-run`. Inspect `journalctl --user -u paper-dry-run` for JSON fill, mint, liquidation/drift, error and stop alerts. No outbound alert recipient is required. Protect logs and configure local retention.
4. Touch the configured emergency file to block entry; stop via `systemctl --user stop paper-dry-run` for SIGTERM. Simulated outstanding positions are flattened. Remove a manual stop only after review.

There is no cron, auto-restart or live activation procedure. Live is hard-disabled. A future release must implement and verify the requirements in verification.md before any production service is installed. Separate OS credentials must contain distinct session keys, never owner seed phrases; permissions and expiry must be confirmed onchain, and owner revocation must be tested manually. Keep HYPE for revocation gas separate from trading risk. The user alone bridges funds from Arbitrum using a route verified at that time and confirms receipt on the intended account; this project does not do it. Manually ensure the combined lifetime funding ceiling and monitor deposits externally. Stops cannot protect against compromised keys or protocol upgrades.
