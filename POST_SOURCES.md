# Individual post sources (v1.6.0)

The downloader now accepts an individual Patreon post URL alongside collections and creator feeds, including links such as https://www.patreon.com/FlexiTown/posts/flexi-town-model-130407907.

Direct post sources inspect only that post. Each run rechecks current attachments even if the post is old. Existing ZIP download history is preserved, and new attachments can be downloaded without automatically fetching previously completed ZIPs again. The dedicated Re-download ZIP action remains available through 3DHub.

For 3DHub, also update the application and Desktop Agent with the matching post-source support. Reload the v1.6.0 extension in chrome://extensions, reopen its dashboard, and reconnect to 3DHub. Existing extension storage does not need to be cleared.

Verification: run each *tests.mjs file with Node, including post-source-tests.mjs.
