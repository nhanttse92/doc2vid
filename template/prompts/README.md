# Job agent prompts

The server fills each `{{placeholder}}` by plain string replacement before launching an agent. Values are plain text; preserve the surrounding prompt. `storyboard.md` is for the initial creative plan; `repair-storyboard.md` and `repair-scene.md` are for failed checks; `scene.md` is one scene agent; `revise.md` handles a finished video's owner follow-up.

| File | Placeholders |
|---|---|
| `storyboard.md` | `{{title}}`, `{{minutes}}`, `{{target_seconds}}`, `{{word_budget}}`, `{{scene_count}}`, `{{user_prompt}}`, `{{has_pages}}` (`yes` or `no`), `{{input_name}}` |
| `repair-storyboard.md` | `{{errors}}` |
| `scene.md` | `{{scene_id}}`, `{{scene_title}}`, `{{beat_ids}}`, `{{scene_seconds}}` |
| `repair-scene.md` | `{{scene_id}}`, `{{error}}` |
| `revise.md` | `{{user_message}}` |
