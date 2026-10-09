"""学习域（learn）存储服务包：主链 M-1 契约的三表存储。

设计关联（DesignRef）：docs/architecture/database-design.md
实现状态：Current
"""

from qed_engine.services.learn.base import (
    LearnConflict,
    LearnNotFound,
    ensure_tables,
    fingerprint,
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
    "fingerprint",
    "norm_key",
]
