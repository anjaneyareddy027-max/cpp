"""Setup script for studyhub-nci package."""

from setuptools import setup, find_packages

setup(
    name="studyhub-nci",
    version="1.0.0",
    author="Anjaneya Reddy",
    description=(
        "Authentication, validation, and task management library "
        "for cloud-based student collaboration platforms"
    ),
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
