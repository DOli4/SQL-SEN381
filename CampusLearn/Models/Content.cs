using System;

namespace CampusLearn.Models
{
    public class Content
    {
        // UML: private attributes
        private int id;
        private string filePath;

        // Constructor 
        public Content(int id, string filePath)
        {
            this.id = id;
            this.filePath = filePath;
        }

        // + relink(newPath)
        public void relink(string newPath)
        {
            if (string.IsNullOrWhiteSpace(newPath))
                throw new ArgumentException("New path cannot be empty.", nameof(newPath));

            filePath = newPath;
        }


        public int GetId() => id;
        public string GetFilePath() => filePath;
    }
}
