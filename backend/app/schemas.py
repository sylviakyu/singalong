from datetime import datetime, timezone
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
Text = Annotated[str, Field(min_length=1, max_length=200)]
class LyricInput(BaseModel):
    start_seconds: float = Field(ge=0, allow_inf_nan=False)
    end_seconds: float = Field(gt=0, allow_inf_nan=False)
    korean: str = Field(min_length=1)
    chinese: str = ''
    romanization: str = ''
    @field_validator('start_seconds', 'end_seconds', mode='before')
    @classmethod
    def numeric(cls, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError('秒數必須是數值')
        return value
    @field_validator('korean', mode='before')
    @classmethod
    def trim(cls, v):
        return v.strip() if isinstance(v, str) else v
    @field_validator('end_seconds')
    @classmethod
    def end_after_start(cls, v, info):
        if 'start_seconds' in info.data and v <= info.data['start_seconds']:
            raise ValueError('結束秒數必須大於開始秒數')
        return v
class SongInput(BaseModel):
    title: Text
    artist: Text
    youtube_video_id: str = Field(min_length=11, max_length=11, pattern=r'^[A-Za-z0-9_-]{11}$')
    lyrics: list[LyricInput] = Field(default_factory=list)
    @field_validator('title', 'artist', mode='before')
    @classmethod
    def trim(cls, v):
        return v.strip() if isinstance(v, str) else v
    @field_validator('lyrics')
    @classmethod
    def ordered(cls, lines):
        for i in range(1, len(lines)):
            if lines[i].start_seconds < lines[i-1].start_seconds:
                raise ValueError(f'第 {i+1} 列開始時間不得早於上一列')
        return lines
class LyricOutput(LyricInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    position: int
class SongSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    artist: str
    youtube_video_id: str
class SongOutput(SongSummary):
    created_at: datetime
    updated_at: datetime
    lyrics: list[LyricOutput]
    @field_validator('created_at', 'updated_at')
    @classmethod
    def utc(cls, value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
class SongPage(BaseModel):
    items: list[SongSummary]
    page: int
    page_size: int
    total: int
    total_pages: int
