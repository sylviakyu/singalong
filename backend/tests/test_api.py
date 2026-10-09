import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, func
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.models import Song, LyricLine

@pytest.fixture
def env():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    event.listen(engine, 'connect', lambda con, _: con.execute('PRAGMA foreign_keys=ON'))
    Base.metadata.create_all(engine)
    def database():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = database
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, engine
    app.dependency_overrides.clear()
    engine.dispose()

def payload(**changes):
    return dict(title=' 歌曲 ', artist=' 歌手 ', youtube_video_id='M7lc1UVf-VE', lyrics=[dict(start_seconds=1.2,end_seconds=2.5,korean=' 안녕 ',chinese='你好',romanization='annyeong')], **changes)

def test_pagination(env):
    c,_=env
    assert c.get('/api/songs').json()['total_pages']==0
    for _ in range(21): assert c.post('/api/songs',json=payload()).status_code==201
    first=c.get('/api/songs').json()
    assert first['total']==21 and first['total_pages']==2 and len(first['items'])==20
    assert first['items'][0]['id']==21 and 'lyrics' not in first['items'][0]
    assert len(c.get('/api/songs?page=2').json()['items'])==1
    assert c.get('/api/songs?page=3').json()['items']==[]
    for query in ['page=0','page_size=0','page_size=101']:
        assert c.get('/api/songs?'+query).status_code==422

@pytest.mark.parametrize('field,value',[('title',' '),('artist',' '),('title','a'*201),('youtube_video_id','bad')])
def test_song_validation(env,field,value):
    c,_=env;data=payload();data[field]=value
    assert c.post('/api/songs',json=data).status_code==422
    assert c.get('/api/songs').json()['total']==0

@pytest.mark.parametrize('change',[{'start_seconds':-1},{'end_seconds':1},{'start_seconds':'1'},{'start_seconds':True},{'korean':'  '},{'end_seconds':None}])
def test_lyric_validation(env,change):
    c,_=env;data=payload();data['lyrics'][0].update(change)
    assert c.post('/api/songs',json=data).status_code==422

@pytest.mark.parametrize('value',['NaN','Infinity','-Infinity'])
def test_nonfinite(env,value):
    c,_=env;data=payload();data['lyrics'][0]['end_seconds']=value
    assert c.post('/api/songs',json=data).status_code==422

def test_order_replace_cascade(env):
    c,engine=env
    created=c.post('/api/songs',json=payload()).json();song_id=created['id']
    assert created['title']=='歌曲' and created['lyrics'][0]['korean']=='안녕'
    assert created['created_at'].endswith('Z')
    data=payload();data['lyrics'].append(dict(start_seconds=0,end_seconds=3,korean='다음'))
    assert c.put(f'/api/songs/{song_id}',json=data).status_code==422
    assert len(c.get(f'/api/songs/{song_id}').json()['lyrics'])==1
    data['lyrics'][1]['start_seconds']=1.5
    updated=c.put(f'/api/songs/{song_id}',json=data).json()
    assert [l['position'] for l in updated['lyrics']]==[1,2]  # overlap permitted
    data['lyrics']=[]
    assert c.put(f'/api/songs/{song_id}',json=data).json()['lyrics']==[]
    c.put(f'/api/songs/{song_id}',json=payload())
    assert c.delete(f'/api/songs/{song_id}').status_code==204
    with Session(engine) as db: assert db.scalar(select(func.count()).select_from(LyricLine))==0
    assert c.get(f'/api/songs/{song_id}').status_code==404
    assert c.put(f'/api/songs/{song_id}',json=payload()).status_code==404
    assert c.delete(f'/api/songs/{song_id}').status_code==404
    # Confirm DB-level cascade, independent of ORM relationship behavior.
    created=c.post('/api/songs',json=payload()).json()
    with engine.begin() as con: con.execute(Song.__table__.delete().where(Song.id==created['id']))
    with Session(engine) as db: assert db.scalar(select(func.count()).select_from(LyricLine))==0

def test_failed_write_rolls_back(env):
    c,engine=env
    created=c.post('/api/songs',json=payload()).json();song_id=created['id']
    def fail_insert(*_): raise RuntimeError('simulated database failure')
    event.listen(LyricLine,'before_insert',fail_insert)
    try:
        data=payload();data['title']='不能留下的新標題'
        assert c.put(f'/api/songs/{song_id}',json=data).status_code==500
        assert c.post('/api/songs',json=data).status_code==500
    finally: event.remove(LyricLine,'before_insert',fail_insert)
    restored=c.get(f'/api/songs/{song_id}').json()
    assert restored['title']=='歌曲' and len(restored['lyrics'])==1
    assert c.get('/api/songs').json()['total']==1
