# Glossary

Definitions of the terms this project defines for itself, and the correct terminology to use for each of these concepts.


## Users

**Low-activity user**: A user who has a small number of activities (e.g. 10 activities).

**High-activity user**: A user who has a large number of activities (e.g. 100 activities).

**High-frequency user**: A user who spins the wheel many times a day (e.g. 10 to 20 times).

**Low-frequency user**: A user who rarely spins the wheel (e.g. 0 to 2 times a day).

**Spin frequency**: How often a user tends to spin the wheel.

**Activity count / Number of activities**: How many activities a user tends to have.


## Core Terminology

**Spin**: One turn of the wheel to get a random activity.

**Picked activity**: The activity the spin selected.

**Session**: A set of back-to-back spins done before resetting or reloading the browser.

**Remaining activities**: The activities that can still be spun this session and have not been spun yet.


## Preference System

**Preference system**: The underlying logic behind what the app learns about how much a user likes each activity.

**Preference-based weighting / Preference-based weight system**: The underlying logic behind how the app decides each activies weight from what it learns about the user's preferences.

**Preference score**: The current guess at how much a user likes an activity.

**Preference score confidence**: How certain we are that the preference score is accurate.

**Preference score uncertainty**: How unsure we are that the preference score is accurate. The opposite of preference score confidence.

**Preference score variance**: The specific value equal to one divided by the preference score confidence.

**Preference score standard deviation**: The specific value equal to one divided by the square root of the preference score confidence. Also, how much a preference score can vary from spin to spin.

**Preference estimate**: The combination of the preference score and its preference score confidence.

**Preference estimate history**: The previous preference estimate that is stored to allow undoing.

**Possible preference score**: A preference score picked for an activity for a specific spin that is within the activity's preference score standard deviation of it's preference score.

**Preference points awarded**: The amount added to the preference score of an activity from a single feedback reaction.

**Reaction count / Number of reactions**: The amount of reactions an activity has been given.

**Preference change resistance**: How resistant a preference score is to changing in response to new feedback.


## Tuning Values

**Initial preference score confidence**: The starting preference score confidence for a new activity.

**Feedback strength**: How much a single reaction changes the preference estimate.

**Preference weight strength**: How much an activity's preference score affects its weight on the wheel.

**Confidence decay rate**: How fast confidence lowers as time passes without any feedback.

**Migration previous feedback strength**: The feedback strength used for each past reaction when replaying an activity's old accept and reject counts during migration.


## Weight System and Shown Values

**Weight system**: The underlying logic behind how the app determines each activities's weight and picks an activity.

**Actual current weight**: The random weight an activity gets for a specific spin. This changes every spin.

**Estimated stable weight**: The average weight an activity will get across many spins. This stays steady from spin to spin.

**Actual current probability**: The chance an activity is picked for a specific spin. This changes every spin.

**Estimated stable probability**: The average chance an activity will be picked across many spins. This stays steady from spin to spin.

**Weight spread**: How much to increase or decrease the differences between weights without changing any stored data related to weights.
