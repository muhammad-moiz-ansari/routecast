"""Regenerate synthetic UI data using pure backend services; never contacts providers."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from services.routing.models import RouteCandidate, RouteOptions
from services.checkpoint.models import CheckpointRequest
from services.checkpoint.checkpoint_service import CheckpointService
from services.weather.models import CheckpointWeather, WeatherResult
from services.risk.models import RiskRequest
from services.risk.risk_service import RiskService
from services.recommendation.recommendation_service import RecommendationService
from services.trip.models import TripCreateRequest
from services.planning.models import AnalysisProjection

start = datetime(2026,11,9,8,tzinfo=timezone.utc)
fetched = start - timedelta(hours=12)
inputs = TripCreateRequest(origin={'latitude':30,'longitude':70},destination={'latitude':31,'longitude':71},departure_at=start,timezone='Asia/Karachi',cargo_load_lb=42000,checkpoint_spacing_miles=25)
routes=[]
checkpoints={}
weather=[]
summaries=[]
for i, identifier in enumerate('ABC'):
    route=RouteCandidate(id=identifier,label=f'Route {identifier}',geometry={'coordinates':[(70,30),(70.3+i*.14,30.3),(70.6+i*.12,30.7),(71,31)]},distance_meters=(100+i*10)*1609.344,duration_seconds=(3+i)*3600,arrival_at=start+timedelta(hours=3+i),timing_notice='ETA uses proportional distance; driving conditions may vary.')
    cp=CheckpointService().generate(CheckpointRequest(route=route,departure_at=start,analysis_version=1))
    matched=[]
    for j,p in enumerate(cp.checkpoints):
        missing=identifier=='C' and j==2
        wind=60 if identifier=='A' and j==1 else 37 if identifier=='B' and j==1 else None if missing else 18
        end=p.arrival_at.replace(minute=0,second=0,microsecond=0)
        if p.arrival_at != end:
            end += timedelta(hours=1)
        matched.append(CheckpointWeather(route_id=identifier,checkpoint_id=p.id,arrival_at=p.arrival_at,fetched_at=fetched,interval_start=end-timedelta(hours=1),interval_end=end,wind_times=[p.arrival_at] if p.arrival_at==end else [end-timedelta(hours=1),end],wind_mph=wind,rain_inches_per_hour=None if missing else 0,snow_inches_per_hour=None if missing else 0,coverage='incomplete' if missing else 'complete',freshness='fresh'))
    summaries.append(RiskService().assess(RiskRequest(route=cp,weather=matched,cargo_load_lb=42000,duration_seconds=route.duration_seconds)))
    checkpoints[identifier]=cp.model_dump(mode='json')
    routes.append(route)
    weather.extend(matched)
rec=RecommendationService(None,None,None).rank(summaries,1)
options=RouteOptions(fetched_at=fetched,routes=routes,available_route_count=3,notices=['Synthetic assessment for interface verification; not live weather.'])
w=WeatherResult(analysis_versions={r.id:1 for r in routes},checkpoints=weather,provider_requests=0,unique_locations_requested=0,estimated_usage_units=0)
projection=AnalysisProjection(trip_id='preview-trip',input_revision=1,analysis_id='preview-analysis',analysis_version=1,analysis_revision=1,status='complete',stage='complete',stopped=False,completed_at=fetched,routing_stale=False,weather_stale=False,data={'inputs':inputs.model_dump(mode='json'),'routes':options.model_dump(mode='json'),'checkpoints':checkpoints,'weather':w.model_dump(mode='json'),'recommendation':rec.model_dump(mode='json'),'routing_fetched_at':fetched.isoformat(),'weather_fetched_at':fetched.isoformat()})
assert rec.recommended_route_id=='B'
Path(__file__).with_name('comparison.json').write_text(json.dumps(projection.model_dump(mode='json'),indent=2)+'\n',encoding='utf-8')
print('Synthetic fixture generated and validated with backend models/services; provider requests: 0')
