"""Initial songs and lyric lines."""
from alembic import op
import sqlalchemy as sa
revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('songs', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('title', sa.Text(), nullable=False), sa.Column('artist', sa.Text(), nullable=False), sa.Column('youtube_video_id', sa.Text(), nullable=False), sa.Column('created_at', sa.DateTime(), nullable=False), sa.Column('updated_at', sa.DateTime(), nullable=False))
    op.create_table('lyric_lines', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('song_id', sa.Integer(), sa.ForeignKey('songs.id', ondelete='CASCADE'), nullable=False), sa.Column('position', sa.Integer(), nullable=False), sa.Column('start_seconds', sa.Float(), nullable=False), sa.Column('end_seconds', sa.Float(), nullable=False), sa.Column('korean', sa.Text(), nullable=False), sa.Column('chinese', sa.Text(), nullable=False), sa.Column('romanization', sa.Text(), nullable=False), sa.UniqueConstraint('song_id', 'position'), sa.CheckConstraint('position >= 1'), sa.CheckConstraint('start_seconds >= 0'), sa.CheckConstraint('end_seconds > start_seconds'))
def downgrade():
    op.drop_table('lyric_lines')
    op.drop_table('songs')
