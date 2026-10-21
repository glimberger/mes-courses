# Device checks

Some requirements need a person and a phone: timings, frame rate, the screen reader, 200% text,
contrast as seen, a power cut, the system backup and the error tracking delivery. They are the
hands-on steps of [quickstart.md](../../specs/001-shopping-lists/quickstart.md) §5 and §6, run before
every release on the code it is built from, each result recorded in the test plan of the pull
request that leads to it.

The performance targets (SC-001 start time, SC-002 tick latency, SC-008 frame rate, SC-011 add
screen) are measured on the two reference phones, an entry-level Android phone about five years
old and the maintainer's iPhone, with the seeded `staging` build (`EXPO_PUBLIC_SEED_ITEMS=200`)
and the setup of [research R11](../../specs/001-shopping-lists/research.md): screen at 60 Hz, airplane
mode on, battery saver off, screen reader off, default text size, light theme, other apps closed.
A target missed on either phone blocks the release until a fix meets it; the pull request records
the miss, its cause and the new measurement.
