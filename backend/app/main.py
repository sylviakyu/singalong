from fastapi import FastAPI, Depends, HTTPException, Query, Response
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .database import get_db
from .models import Song, LyricLine, now
from .schemas import SongInput, SongOutput, SongPage
app = FastAPI(title='韓文跟唱 API')

def get_song(db, song_id):
    song = db.get(Song, song_id)
    if not song:
        raise HTTPException(404, '找不到歌曲')
    return song

@app.get('/api/songs', response_model=SongPage)
def list_songs(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Song))
    items = db.scalars(select(Song).order_by(Song.id.desc()).offset((page-1)*page_size).limit(page_size)).all()
    return dict(items=items, page=page, page_size=page_size, total=total, total_pages=(total+page_size-1)//page_size)

@app.get('/api/songs/{song_id}', response_model=SongOutput)
def detail(song_id: int, db: Session = Depends(get_db)):
    return get_song(db, song_id)

def save(db, song, data):
    try:
        for key in ('title', 'artist', 'youtube_video_id'):
            setattr(song, key, getattr(data, key))
        song.updated_at = now()
        song.lyrics.clear()
        db.flush()
        song.lyrics = [LyricLine(position=i+1, **line.model_dump()) for i, line in enumerate(data.lyrics)]
        db.add(song)
        db.commit()
        db.refresh(song)
        return song
    except Exception:
        db.rollback()
        raise

@app.post('/api/songs', response_model=SongOutput, status_code=201)
def create(data: SongInput, db: Session = Depends(get_db)):
    return save(db, Song(), data)

@app.put('/api/songs/{song_id}', response_model=SongOutput)
def update(song_id: int, data: SongInput, db: Session = Depends(get_db)):
    return save(db, get_song(db, song_id), data)

@app.delete('/api/songs/{song_id}', status_code=204)
def delete(song_id: int, db: Session = Depends(get_db)):
    db.delete(get_song(db, song_id))
    db.commit()
    return Response(status_code=204)
