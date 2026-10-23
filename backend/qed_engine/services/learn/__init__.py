"""学习域（learn）存储服务包：v1.0 三张根私有表的存储实现。

设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
"""

from qed_engine.services.learn.base import (
    LearnConflict,
    LearnNotFound,
    ensure_tables,
)
from qed_engine.services.learn.knowledge import KP_TYPES, MySQLKnowledgeStore, norm_key
from qed_engine.services.learn.knowledge_memory import InMemoryKnowledgeStore
from qed_engine.services.learn.memory import InMemoryLearnStore
from qed_engine.services.learn.practice_memory import InMemoryPracticeStore

__all__ = [
    "KP_TYPES",
    "InMemoryKnowledgeStore",
    "InMemoryLearnStore",
    "InMemoryPracticeStore",
    "LearnConflict",
    "LearnNotFound",
    "MySQLKnowledgeStore",
    "ensure_tables",
    "norm_key",
]
