from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def now():
    return datetime.now(timezone.utc)
class Song(Base):
    __tablename__ = 'songs'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]
    artist: Mapped[str]
    youtube_video_id: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(default=now)
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)
    lyrics: Mapped[list['LyricLine']] = relationship(cascade='all, delete-orphan', passive_deletes=True, order_by='LyricLine.position')
class LyricLine(Base):
    __tablename__ = 'lyric_lines'
    __table_args__ = (UniqueConstraint('song_id', 'position'), CheckConstraint('position >= 1'), CheckConstraint('start_seconds >= 0'), CheckConstraint('end_seconds > start_seconds'))
    id: Mapped[int] = mapped_column(primary_key=True)
    song_id: Mapped[int] = mapped_column(ForeignKey('songs.id', ondelete='CASCADE'))
    position: Mapped[int]
    start_seconds: Mapped[float]
    end_seconds: Mapped[float]
    korean: Mapped[str]
    chinese: Mapped[str] = mapped_column(default='')
    romanization: Mapped[str] = mapped_column(default='')
