"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

const topics = [
  { id: "cs.AI", label: "Artificial Intelligence" },
  { id: "cs.LG", label: "Machine Learning" },
  { id: "cs.CV", label: "Computer Vision" },
  { id: "cs.RO", label: "Robotics" },
];

interface Paper {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  published: string;
  arxiv_url: string;
}

export default function Home() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTopicChange = (topicId: string, checked: boolean) => {
    setSelectedTopics((prev) =>
      checked
        ? [...prev, topicId]
        : prev.filter((id) => id !== topicId)
    );
  };

  const handleFetchPapers = async () => {
    if (selectedTopics.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/papers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics: selectedTopics }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch papers");
      }
      
      const data = await response.json();
      setPapers(data.papers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching papers:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-800 shadow-md">
        <h1 className="text-2xl font-bold tracking-tight">Podcast Studio</h1>
        <nav>
          <Button variant="ghost" className="text-gray-300 hover:text-white">
            Settings
          </Button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Topic Selection */}
        <section className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Select Topics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="flex items-center space-x-3 p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
              >
                <Checkbox
                  id={topic.id}
                  checked={selectedTopics.includes(topic.id)}
                  onCheckedChange={(checked) =>
                    handleTopicChange(topic.id, checked as boolean)
                  }
                  className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <label
                  htmlFor={topic.id}
                  className="text-sm font-medium text-gray-200 cursor-pointer flex-1"
                >
                  {topic.label}
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Fetch Papers Button */}
        <section className="flex flex-col items-center space-y-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg disabled:opacity-50"
            onClick={handleFetchPapers}
            disabled={selectedTopics.length === 0 || loading}
          >
            {loading ? "Fetching Papers..." : "Fetch Papers"}
          </Button>
          {selectedTopics.length > 0 && (
            <p className="text-sm text-gray-400">
              Selected: {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''}
            </p>
          )}
        </section>

        {/* Paper Preview */}
        <section className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Recent Papers</h2>
          <ScrollArea className="h-96">
            {error ? (
              <div className="text-center py-8">
                <p className="text-red-400 mb-2">Error loading papers</p>
                <p className="text-gray-400 text-sm">{error}</p>
              </div>
            ) : papers.length > 0 ? (
              <div className="space-y-4">
                {papers.map((paper) => (
                  <Card
                    key={paper.id}
                    className="bg-gray-700 border-gray-600 hover:bg-gray-600 transition-colors"
                  >
                    <CardHeader>
                      <CardTitle className="text-lg text-white">
                        {paper.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 text-sm mb-2">{paper.authors}</p>
                      <p className="text-gray-500 text-xs mb-2">
                        Published: {new Date(paper.published).toLocaleDateString()}
                      </p>
                      <p className="text-gray-400 text-sm mb-3 line-clamp-3">
                        {paper.abstract}
                      </p>
                      <div className="flex space-x-2">
                        <Button
                          variant="link"
                          className="text-blue-400 p-0 h-auto"
                          onClick={() =>
                            console.log(`Selected paper: ${paper.title}`)
                          }
                        >
                          Select Paper
                        </Button>
                        <Button
                          variant="link"
                          className="text-green-400 p-0 h-auto"
                          onClick={() => window.open(paper.arxiv_url, '_blank')}
                        >
                          View on arXiv
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                No papers loaded. Select topics and click &quot;Fetch Papers&quot; to get started.
              </p>
            )}
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}
