# Individual post sources (v1.7.0)

The downloader now accepts an individual Patreon post URL alongside collections and creator feeds, including links such as https://www.patreon.com/FlexiTown/posts/flexi-town-model-130407907.

Direct post sources inspect only that post. Date-scoped jobs first fetch publication metadata without navigating to the post. Older posts are excluded; unverified dates are reported as incomplete and are not opened. Use All time to recheck an older monthly post for new attachments. Existing ZIP download history and the dedicated Re-download ZIP action remain intact.

For 3DHub, update the application and Desktop Agent to v1.40. Reload extension v1.7.0 in chrome://extensions, reopen its dashboard, and reconnect to 3DHub. Stop older jobs and start a fresh check. Existing extension storage does not need to be cleared.

Verification: run each *tests.mjs file with Node, including post-source-tests.mjs.
