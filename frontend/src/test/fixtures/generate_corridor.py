"""Generate deterministic Phase 9 data through the offline backend projection."""
import os
os.environ["DJANGO_SETTINGS_MODULE"]="config.settings.test"
import django
django.setup()
import json
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from services.corridor.corridor_service import CorridorService
from services.corridor.geometry import make_grid
from services.corridor.models import CorridorDataset, CorridorRequest
from services.routing.models import RouteOptions

root=Path(__file__).parent
analysis=json.loads((root/"comparison.json").read_text())
grid=make_grid(CorridorRequest(routes=RouteOptions.model_validate(analysis["data"]["routes"]).routes))
anchor=datetime.fromisoformat(analysis["completed_at"])
times=[anchor+timedelta(hours=i) for i in range(49)]
names=("wind_mph","rain_inches_per_hour","snow_inches_per_hour")
values={name:[] for name in names}
for i in range(len(grid.samples)):
    values["wind_mph"].append([None if i%11==0 and f%7==0 else 18+(i+f)%44 for f in range(49)])
    values["rain_inches_per_hour"].append([round(((i+f)%12)*.1,2) for f in range(49)])
    values["snow_inches_per_hour"].append([round(((i+f)%8)*.5,2) for f in range(49)])
source=CorridorDataset(dataset_id="synthetic-corridor",analysis_version=1,anchor_at=anchor,fetched_at=anchor,timestamps=times,grid=grid,values=values,missing={n:[[v is None for v in row] for row in rows] for n,rows in values.items()},units={"wind_mph":"mph","rain_inches_per_hour":"in/hour","snow_inches_per_hour":"in/hour"},coverage="partial",notices=["Synthetic prefetched corridor; not live weather."]).model_dump(mode="json")
job=SimpleNamespace(id="synthetic-corridor",status="partial",error_code=None,data=source,analysis=SimpleNamespace(version=1,revision=1,payload=analysis["data"]))
store=SimpleNamespace(read=lambda *_:(SimpleNamespace(active=True,input_revision=1),job))
service=CorridorService(store,None,None,SimpleNamespace(get=lambda _:None),None,None,None,clock=lambda:anchor)
projection=service.read("offline-owner","offline-trip")
assert "risk_categories" not in source
assert len(projection["data"]["risk_categories"])==len(grid.samples)
(root/"corridor.json").write_text(json.dumps(projection,indent=2)+"\n",encoding="utf-8")
print(f"Validated 49 frames for {len(grid.samples)} synthetic samples; backend risk projection; no provider or database.")
