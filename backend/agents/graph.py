from langgraph.graph import END, START, StateGraph

from agents.bear import bear_node
from agents.bull import bull_node
from agents.judge import judge_node
from agents.state import ThesisState


def build_graph():
    graph = StateGraph(ThesisState)

    graph.add_node("bull", bull_node)
    graph.add_node("bear", bear_node)
    graph.add_node("judge", judge_node)

    graph.add_edge(START, "bull")
    graph.add_edge("bull", "bear")
    graph.add_edge("bear", "judge")
    graph.add_edge("judge", END)

    return graph.compile()
